defmodule QaAssistWeb.SessionJsonController do
  use QaAssistWeb, :controller

  alias QaAssist.Artifacts
  alias QaAssistWeb.ControllerHelpers

  def create(conn, %{"id" => session_id} = params) do
    case ControllerHelpers.require_session(conn, session_id) do
      {:ok, _session} ->
        case Artifacts.store_session_json(session_id, params) do
          {:ok, artifact} -> json(conn, %{ok: true, artifact: artifact})
          {:error, reason} -> ControllerHelpers.send_error(conn, 400, to_string(reason))
        end

      {:error, conn} ->
        conn
    end
  end

  def rebuild(conn, %{"id" => session_id}) do
    case ControllerHelpers.require_session(conn, session_id) do
      {:ok, _session} ->
        case Artifacts.rebuild_session_json(session_id) do
          {:ok, artifact} -> json(conn, %{ok: true, artifact: artifact})
          {:error, reason} -> ControllerHelpers.send_error(conn, 400, to_string(reason))
        end

      {:error, conn} ->
        conn
    end
  end
end
