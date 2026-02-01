defmodule QaAssist.Storage.GcsIntegrationTest do
  use ExUnit.Case, async: false

  @moduletag :gcs

  alias QaAssist.Recording.Chunk
  alias QaAssist.Storage.Gcs

  @required_envs ["GCS_IT_BUCKET", "GCS_IT_SIGNING_EMAIL", "GCS_IT_PRIVATE_KEY"]

  setup do
    missing =
      Enum.filter(@required_envs, fn key ->
        System.get_env(key) in [nil, ""]
      end)

    if missing != [] do
      raise "Missing env vars for GCS integration test: #{Enum.join(missing, ", ")}"
    end

    previous = Application.get_env(:qa_assist, :storage)

    Application.put_env(:qa_assist, :storage,
      backend: QaAssist.Storage.Gcs,
      gcs: [
        bucket: System.get_env("GCS_IT_BUCKET"),
        client_email: System.get_env("GCS_IT_SIGNING_EMAIL"),
        private_key: System.get_env("GCS_IT_PRIVATE_KEY"),
        expires: 900,
        region: System.get_env("GCS_IT_REGION", "auto")
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

  test "uploads via signed url and downloads content" do
    chunk = %Chunk{id: Ecto.UUID.generate()}
    payload = Gcs.prepare_upload(chunk, "video/webm")

    data = <<0, 1, 2, 3, 4, 5, 6, 7, 8, 9>>
    headers = Map.to_list(payload.upload_headers || %{})

    {:ok, upload} =
      Req.put(payload.upload_url,
        body: data,
        headers: headers
      )

    assert upload.status in [200, 201]

    download_url = Gcs.signed_download_url(payload.gcs_uri)
    {:ok, download} = Req.get(download_url)

    assert download.status == 200
    assert download.body == data
  end
end
