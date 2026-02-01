defmodule QaAssist.Storage.Gcs do
  alias QaAssist.Recording.Chunk

  @default_expires 900

  def prepare_upload(%Chunk{} = chunk, content_type) do
    config = gcs_config!()
    validate_config!(config)

    bucket = config[:bucket]
    object = "chunks/#{chunk.id}.webm"
    gcs_uri = "gs://#{bucket}/#{object}"

    upload_headers = base_headers(content_type)
    upload_url = signed_url("PUT", bucket, object, upload_headers, config)

    resumable_headers =
      base_headers(content_type)
      |> Map.put("x-goog-resumable", "start")

    resumable_url = signed_url("POST", bucket, object, resumable_headers, config)

    %{
      storage: "gcs",
      gcs_uri: gcs_uri,
      upload_url: upload_url,
      upload_method: "PUT",
      upload_headers: strip_host(upload_headers),
      resumable: %{
        start_url: resumable_url,
        start_method: "POST",
        start_headers: strip_host(resumable_headers)
      }
    }
  end

  def prepare_object_upload(object, content_type) when is_binary(object) do
    config = gcs_config!()
    validate_config!(config)

    bucket = config[:bucket]
    gcs_uri = "gs://#{bucket}/#{object}"

    upload_headers = base_headers(content_type)
    upload_url = signed_url("PUT", bucket, object, upload_headers, config)

    %{
      storage: "gcs",
      gcs_uri: gcs_uri,
      upload_url: upload_url,
      upload_method: "PUT",
      upload_headers: strip_host(upload_headers)
    }
  end

  def store_upload(%Chunk{} = _chunk, %Plug.Upload{} = _upload) do
    {:error, "direct upload required for gcs storage"}
  end

  def signed_download_url(gcs_uri) when is_binary(gcs_uri) do
    config = gcs_config!()
    validate_config!(config)

    case parse_gcs_uri(gcs_uri) do
      {:ok, bucket, object} ->
        signed_url("GET", bucket, object, %{"host" => "storage.googleapis.com"}, config)

      :error ->
        gcs_uri
    end
  end

  defp base_headers(nil), do: %{"host" => "storage.googleapis.com"}

  defp base_headers(content_type) do
    %{
      "host" => "storage.googleapis.com",
      "content-type" => content_type
    }
  end

  defp strip_host(headers), do: Map.delete(headers, "host")

  defp signed_url(method, bucket, object, headers, config) do
    expires = config[:expires] || @default_expires

    datetime = DateTime.utc_now()
    date = format_date(datetime)
    timestamp = format_timestamp(datetime)

    region = config[:region] || "auto"
    credential_scope = "#{date}/#{region}/storage/goog4_request"
    credential = "#{config[:client_email]}/#{credential_scope}"

    signed_headers = headers |> Map.keys() |> Enum.map(&String.downcase/1) |> Enum.sort()
    signed_headers_string = Enum.join(signed_headers, ";")

    canonical_headers =
      signed_headers
      |> Enum.map(fn key -> "#{key}:#{headers[key]}\n" end)
      |> Enum.join()

    canonical_query =
      %{
        "X-Goog-Algorithm" => "GOOG4-RSA-SHA256",
        "X-Goog-Credential" => credential,
        "X-Goog-Date" => timestamp,
        "X-Goog-Expires" => Integer.to_string(expires),
        "X-Goog-SignedHeaders" => signed_headers_string
      }
      |> Enum.sort_by(fn {key, _} -> key end)
      |> Enum.map(fn {key, value} ->
        "#{uri_encode(to_string(key))}=#{uri_encode(to_string(value))}"
      end)
      |> Enum.join("&")

    canonical_request =
      Enum.join(
        [
          method,
          "/#{bucket}/#{object}",
          canonical_query,
          canonical_headers,
          signed_headers_string,
          "UNSIGNED-PAYLOAD"
        ],
        "\n"
      )

    string_to_sign =
      Enum.join(
        [
          "GOOG4-RSA-SHA256",
          timestamp,
          credential_scope,
          sha256_hex(canonical_request)
        ],
        "\n"
      )

    signature = rsa_sign(string_to_sign, config[:private_key]) |> Base.encode16(case: :lower)

    "https://storage.googleapis.com/#{bucket}/#{object}?#{canonical_query}&X-Goog-Signature=#{signature}"
  end

  defp rsa_sign(data, private_key_pem) do
    private_key =
      private_key_pem
      |> String.replace("\\n", "\n")
      |> :public_key.pem_decode()
      |> List.first()
      |> :public_key.pem_entry_decode()

    :public_key.sign(data, :sha256, private_key)
  end

  defp sha256_hex(data) do
    :crypto.hash(:sha256, data) |> Base.encode16(case: :lower)
  end

  defp uri_encode(value) do
    URI.encode(value, &URI.char_unreserved?/1)
  end

  defp format_date(datetime) do
    datetime
    |> DateTime.to_date()
    |> Date.to_iso8601()
    |> String.replace("-", "")
  end

  defp format_timestamp(datetime) do
    datetime
    |> DateTime.truncate(:second)
    |> Calendar.strftime("%Y%m%dT%H%M%SZ")
  end

  defp gcs_config! do
    storage = Application.get_env(:qa_assist, :storage, [])
    gcs = Keyword.get(storage, :gcs, [])

    %{
      bucket: Keyword.get(gcs, :bucket),
      client_email: Keyword.get(gcs, :client_email),
      private_key: Keyword.get(gcs, :private_key),
      expires: Keyword.get(gcs, :expires),
      region: Keyword.get(gcs, :region)
    }
  end

  defp parse_gcs_uri("gs://" <> rest) do
    case String.split(rest, "/", parts: 2) do
      [bucket, object] -> {:ok, bucket, object}
      _ -> :error
    end
  end

  defp parse_gcs_uri(_), do: :error

  defp validate_config!(config) do
    cond do
      is_nil(config[:bucket]) ->
        raise "GCS bucket not configured"

      is_nil(config[:client_email]) ->
        raise "GCS signing email not configured"

      is_nil(config[:private_key]) ->
        raise "GCS signing private key not configured"

      true ->
        :ok
    end
  end
end
