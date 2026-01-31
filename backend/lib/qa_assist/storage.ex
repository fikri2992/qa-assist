defmodule QaAssist.Storage do
  alias QaAssist.Recording.Chunk

  def store_upload(%Chunk{} = chunk, %Plug.Upload{} = upload) do
    backend().store_upload(chunk, upload)
  end

  def public_url(nil), do: nil

  def public_url(gcs_uri) when is_binary(gcs_uri) do
    if String.starts_with?(gcs_uri, "/") do
      QaAssistWeb.Endpoint.url() <> gcs_uri
    else
      gcs_uri
    end
  end

  defp backend do
    config = Application.get_env(:qa_assist, :storage, [])
    Keyword.get(config, :backend, QaAssist.Storage.Local)
  end
end
