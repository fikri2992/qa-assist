defmodule QaAssistWeb.SessionController do
  use QaAssistWeb, :controller

  alias QaAssist.Recording
  alias QaAssist.Storage
  alias QaAssistWeb.ControllerHelpers

  def index(conn, _params) do
    case ControllerHelpers.fetch_device_id(conn) do
      nil ->
        ControllerHelpers.send_error(conn, 400, "device_id required")

      device_id ->
        sessions = Recording.list_sessions(device_id)
        json(conn, Enum.map(sessions, &session_summary/1))
    end
  end

  def create(conn, params) do
    case ControllerHelpers.fetch_device_id(conn) do
      nil ->
        ControllerHelpers.send_error(conn, 400, "device_id required")

      device_id ->
        metadata = Map.get(params, "metadata", %{})

        case Recording.create_session(device_id, metadata) do
          {:ok, session} ->
            json(conn, %{session: session_payload(session)})

          {:error, :device_not_found} ->
            ControllerHelpers.send_error(conn, 404, "device not found")

          {:error, _changeset} ->
            ControllerHelpers.send_error(conn, 400, "failed to create session")
        end
    end
  end

  def start(conn, %{"id" => id}) do
    with {:ok, session} <- load_session(id),
         {:ok, updated} <- Recording.start_session(session) do
      json(conn, %{
        session: session_payload(updated),
        upload_base_url: QaAssistWeb.Endpoint.url() <> "/api"
      })
    else
      {:error, :not_found} -> ControllerHelpers.send_error(conn, 404, "session not found")
      {:error, _} -> ControllerHelpers.send_error(conn, 400, "failed to start session")
    end
  end

  def stop(conn, %{"id" => id}) do
    with {:ok, session} <- load_session(id),
         {:ok, updated} <- Recording.stop_session(session) do
      json(conn, %{session: session_payload(updated)})
    else
      {:error, :not_found} -> ControllerHelpers.send_error(conn, 404, "session not found")
      {:error, _} -> ControllerHelpers.send_error(conn, 400, "failed to stop session")
    end
  end

  def show(conn, %{"id" => id}) do
    with {:ok, session} <- load_session(id) do
      chunks = Recording.list_chunks(session.id)

      payload =
        session_payload(session)
        |> Map.put(:chunks, Enum.map(chunks, &chunk_payload/1))

      json(conn, payload)
    else
      {:error, :not_found} -> ControllerHelpers.send_error(conn, 404, "session not found")
    end
  end

  defp load_session(id) do
    case Recording.get_session(id) do
      nil -> {:error, :not_found}
      session -> {:ok, session}
    end
  end

  defp session_summary(session) do
    %{
      id: session.id,
      status: session.status,
      started_at: session.started_at,
      ended_at: session.ended_at,
      inserted_at: session.inserted_at
    }
  end

  defp session_payload(session) do
    %{
      id: session.id,
      device_id: session.device_id,
      status: session.status,
      started_at: session.started_at,
      ended_at: session.ended_at,
      idle_paused_at: session.idle_paused_at,
      metadata: session.metadata || %{}
    }
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
