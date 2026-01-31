defmodule QaAssistWeb.EventController do
  use QaAssistWeb, :controller

  alias QaAssist.Recording
  alias QaAssistWeb.ControllerHelpers

  def create(conn, %{"id" => session_id, "events" => events}) when is_list(events) do
    case ControllerHelpers.require_session(conn, session_id) do
      {:ok, _session} ->
        case Recording.record_events(session_id, events) do
          {:ok, count} -> json(conn, %{inserted: count})
          {:error, _} -> ControllerHelpers.send_error(conn, 400, "failed to ingest events")
        end

      {:error, conn} ->
        conn
    end
  end

  def create(conn, _params) do
    ControllerHelpers.send_error(conn, 400, "events list required")
  end

  def index(conn, %{"id" => session_id} = params) do
    limit = parse_limit(params["limit"])

    case ControllerHelpers.require_session(conn, session_id) do
      {:ok, _session} ->
        events = Recording.list_events(session_id, limit)
        json(conn, Enum.map(events, &event_payload/1))

      {:error, conn} ->
        conn
    end
  end

  defp parse_limit(nil), do: 200

  defp parse_limit(value) when is_binary(value) do
    case Integer.parse(value) do
      {parsed, _} -> min(parsed, 1000)
      :error -> 200
    end
  end

  defp event_payload(event) do
    %{
      id: event.id,
      session_id: event.session_id,
      ts: event.ts,
      type: event.type,
      payload: event.payload
    }
  end
end
