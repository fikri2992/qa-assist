defmodule QaAssistWeb.ChunkController do
  use QaAssistWeb, :controller

  alias QaAssist.Recording
  alias QaAssist.Storage
  alias QaAssistWeb.ControllerHelpers

  def create(conn, %{"id" => session_id} = params) do
    case Recording.get_session(session_id) do
      nil ->
        ControllerHelpers.send_error(conn, 404, "session not found")

      _session ->
        case Recording.create_chunk(session_id, params) do
          {:ok, chunk} ->
            upload_info = Storage.prepare_upload(chunk, params["content_type"])

            json(
              conn,
              Map.merge(%{chunk: chunk_payload(chunk)}, upload_info)
            )

          {:error, _changeset} ->
            ControllerHelpers.send_error(conn, 400, "failed to create chunk")
        end
    end
  end

  def update(conn, %{"id" => id} = params) do
    case Recording.get_chunk(id) do
      nil ->
        ControllerHelpers.send_error(conn, 404, "chunk not found")

      chunk ->
        case Recording.update_chunk(chunk, params) do
          {:ok, updated} -> json(conn, %{chunk: chunk_payload(updated)})
          {:error, _} -> ControllerHelpers.send_error(conn, 400, "failed to update chunk")
        end
    end
  end

  def upload(conn, %{"id" => id, "file" => %Plug.Upload{} = upload}) do
    if Storage.backend_module() == QaAssist.Storage.Gcs do
      ControllerHelpers.send_error(conn, 400, "direct upload required for gcs storage")
    else
      case Recording.get_chunk(id) do
        nil ->
          ControllerHelpers.send_error(conn, 404, "chunk not found")

        chunk ->
          case Storage.store_upload(chunk, upload) do
            {:ok, %{gcs_uri: gcs_uri, byte_size: byte_size, content_type: content_type}} ->
              case Recording.mark_chunk_ready(chunk, gcs_uri, byte_size, content_type) do
                {:ok, updated} -> json(conn, %{chunk: chunk_payload(updated)})
                {:error, _} -> ControllerHelpers.send_error(conn, 400, "failed to update chunk")
              end

            {:error, reason} ->
              ControllerHelpers.send_error(conn, 400, "upload failed: #{reason}")
          end
      end
    end
  end

  def upload(conn, _params) do
    ControllerHelpers.send_error(conn, 400, "file upload missing")
  end

  defp chunk_payload(chunk) do
    %{
      id: chunk.id,
      session_id: chunk.session_id,
      idx: chunk.idx,
      start_ts: chunk.start_ts,
      end_ts: chunk.end_ts,
      status: chunk.status,
      analysis_status: chunk.analysis_status,
      gcs_uri: chunk.gcs_uri,
      video_url: Storage.public_url(chunk.gcs_uri)
    }
  end
end
