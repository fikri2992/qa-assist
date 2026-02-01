defmodule QaAssistWeb.ChatController do
  use QaAssistWeb, :controller

  alias QaAssist.AI
  alias QaAssist.Analysis
  alias QaAssist.Recording
  alias QaAssistWeb.ControllerHelpers

  def create(conn, %{"id" => session_id} = params) do
    case ControllerHelpers.require_session(conn, session_id) do
      {:ok, session} ->
        events = Recording.list_events(session.id, 200)
        analysis = Analysis.get_session_report(session.id)

        payload = %{
          session: serialize_session(session),
          events: Enum.map(events, &serialize_event/1),
          analysis: analysis,
          message: Map.get(params, "message", ""),
          mode: Map.get(params, "mode", "investigate"),
          model: Map.get(params, "model", "default"),
          resources: Map.get(params, "resources", []),
          images: Map.get(params, "images", [])
        }

        case AI.chat(payload) do
          {:ok, body} -> json(conn, body)
          {:error, reason} -> ControllerHelpers.send_error(conn, 502, reason)
        end

      {:error, conn} ->
        conn
    end
  end

  defp serialize_session(session) do
    %{
      id: session.id,
      device_id: session.device_id,
      status: session.status,
      started_at: session.started_at,
      ended_at: session.ended_at,
      metadata: session.metadata || %{}
    }
  end

  defp serialize_event(event) do
    %{
      id: event.id,
      session_id: event.session_id,
      ts: event.ts,
      type: event.type,
      payload: event.payload
    }
  end
end
