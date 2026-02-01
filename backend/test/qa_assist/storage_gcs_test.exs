defmodule QaAssist.Storage.GcsTest do
  use ExUnit.Case, async: true

  alias QaAssist.Recording.Chunk
  alias QaAssist.Storage.Gcs

  @private_key """
  -----BEGIN PRIVATE KEY-----
  MIICdgIBADANBgkqhkiG9w0BAQEFAASCAmAwggJcAgEAAoGBALz3DBz5cYZ5XLcc
  q/c+4Tc52GyNDxjCSMjfGc+aI2kv0NkPFfXiyQjYhbv7pQ9vv5r7B4KwAyM4xKAU
  3wEi/+XGlFjeKOd0roUOFdMSDwAm5xXZJubFzflpeoazvbzmunDG8dm+c6fu3tZc
  BhMuab9YVYOLNqkTkYjCN23veAwDAgMBAAECgYBYszJ5a1GxyMgPoCLMpTR8guen
  VLNwcMpPmAH6pCTZHDvRl7Y8PF8XiuODsQTy8Qakzg7hdpOSdfQ+HG3tj6tENcPo
  qazWOkOvnYQpMx+mgk09Fc8NiVAFrWR4XRAsTUIJXdvbqWNIehZuAU54yg4vXn6L
  KbYBGL1mzfVLyoZ2EQJBAPSMeTu1I8C6HvlGuWtNA6PBVjmWEiKqb4/G+IrVD2RI
  1TiJOa03S1l5jdUrzbZB7SuUcGGypuIyyb/hOI7q1HkCQQDF0EO28cFuJzIAo5ro
  5larefgV5iIiUqOpKwgidqSG4F0z6JM91ymrHbML6ZL7QW599TrN96gYmcJNMIFJ
  /21bAkAlLD05cD1xDFms9q00vE4zVC4xLrivAE1ZA5vALsbaLaALqgBUbjVL8og2
  wSPR8o+Eslmq4Ccx9xpnymp4fwWxAkAnP2IgCylwvJAcNlnG+eSaUzHYzndZTgIw
  z1vm0plkNWHoqa2FKIqY6+SZaXeDKIFOtng7Y3bTorY9cHFGiEpfAkEAwwUOTaQ0
  zsFkAK0t+mTs4hLtYkJpsd7D0vLLH5ocDDty2cMtFPMkbfyIDTFI+bU6QSlnwzgr
  EqB/3l1sKrHlUg==
  -----END PRIVATE KEY-----
  """

  setup do
    previous = Application.get_env(:qa_assist, :storage)

    Application.put_env(:qa_assist, :storage,
      backend: QaAssist.Storage.Gcs,
      gcs: [
        bucket: "qa-assist-test",
        client_email: "signer@qaassist.local",
        private_key: @private_key,
        expires: 900
      ]
    )

    on_exit(fn ->
      if is_nil(previous) do
        Application.delete_env(:qa_assist, :storage)
      else
        Application.put_env(:qa_assist, :storage, previous)
      end
    end)

    :ok
  end

  test "prepare_upload builds signed urls and headers" do
    chunk = %Chunk{id: Ecto.UUID.generate()}
    payload = Gcs.prepare_upload(chunk, "video/webm")

    assert payload.storage == "gcs"
    assert payload.upload_method == "PUT"
    assert payload.gcs_uri == "gs://qa-assist-test/chunks/#{chunk.id}.webm"
    assert payload.upload_headers["content-type"] == "video/webm"
    refute Map.has_key?(payload.upload_headers, "host")

    assert payload.resumable.start_method == "POST"
    assert payload.resumable.start_headers["x-goog-resumable"] == "start"

    assert_signed_url(payload.upload_url, chunk.id, ["content-type", "host"])
    assert_signed_url(payload.resumable.start_url, chunk.id, ["content-type", "host", "x-goog-resumable"])
  end

  test "signed_download_url signs gcs uri" do
    url = Gcs.signed_download_url("gs://qa-assist-test/chunks/demo.webm")
    uri = URI.parse(url)

    assert uri.scheme == "https"
    assert uri.host == "storage.googleapis.com"
    assert uri.path == "/qa-assist-test/chunks/demo.webm"
  end

  defp assert_signed_url(url, chunk_id, expected_headers) do
    uri = URI.parse(url)
    assert uri.scheme == "https"
    assert uri.host == "storage.googleapis.com"
    assert uri.path == "/qa-assist-test/chunks/#{chunk_id}.webm"

    query = URI.decode_query(uri.query || "")
    assert query["X-Goog-Algorithm"] == "GOOG4-RSA-SHA256"
    assert query["X-Goog-Credential"]
    assert query["X-Goog-Date"]
    assert query["X-Goog-Expires"]
    assert query["X-Goog-SignedHeaders"]
    assert query["X-Goog-Signature"]

    signed_headers = String.split(query["X-Goog-SignedHeaders"], ";")
    Enum.each(expected_headers, fn header ->
      assert header in signed_headers
    end)
  end
end
