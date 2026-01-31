defmodule QaAssist.Storage.Local do
  alias QaAssist.Recording.Chunk

  def store_upload(%Chunk{} = chunk, %Plug.Upload{} = upload) do
    base_dir = Path.join([priv_dir(), "static", "storage", "chunks"])
    File.mkdir_p!(base_dir)

    ext = Path.extname(upload.filename)
    filename = if ext == "", do: "#{chunk.id}.webm", else: "#{chunk.id}#{ext}"
    target_path = Path.join(base_dir, filename)

    File.cp!(upload.path, target_path)

    {:ok,
     %{
       gcs_uri: "/storage/chunks/#{filename}",
       byte_size: File.stat!(target_path).size,
       content_type: upload.content_type
     }}
  end

  defp priv_dir do
    :code.priv_dir(:qa_assist)
    |> to_string()
  end
end
