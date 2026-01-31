defmodule QaAssist.Storage.Gcs do
  alias QaAssist.Recording.Chunk

  def store_upload(%Chunk{} = _chunk, %Plug.Upload{} = _upload) do
    {:error, "gcs storage not configured"}
  end
end
