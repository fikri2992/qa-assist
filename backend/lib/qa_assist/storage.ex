defmodule QaAssist.Storage do
  alias QaAssist.Recording.Chunk

  def prepare_upload(%Chunk{} = chunk, content_type) do
    backend().prepare_upload(chunk, content_type)
  end

  def store_upload(%Chunk{} = chunk, %Plug.Upload{} = upload) do
    backend().store_upload(chunk, upload)
  end

  def public_url(nil), do: nil

  def public_url(gcs_uri) when is_binary(gcs_uri) do
    cond do
      String.starts_with?(gcs_uri, "/") ->
        QaAssistWeb.Endpoint.url() <> gcs_uri

      String.starts_with?(gcs_uri, "gs://") ->
        gcs_uri
        |> String.replace_prefix("gs://", "")
        |> String.split("/", parts: 2)
        |> case do
          [bucket, object] -> "https://storage.googleapis.com/#{bucket}/#{object}"
          _ -> gcs_uri
        end

      true ->
        gcs_uri
    end
  end

  defp backend do
    config = Application.get_env(:qa_assist, :storage, [])
    Keyword.get(config, :backend, QaAssist.Storage.Local)
  end

  def backend_module, do: backend()
end
