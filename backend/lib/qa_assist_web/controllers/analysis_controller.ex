defmodule QaAssistWeb.AnalysisController do
  use QaAssistWeb, :controller

  alias QaAssist.Analysis
  alias QaAssist.Recording
  alias QaAssistWeb.ControllerHelpers

  def show(conn, %{"id" => session_id}) do
    case Recording.get_session(session_id) do
      nil ->
        ControllerHelpers.send_error(conn, 404, "session not found")

      _session ->
        json(conn, Analysis.get_session_report(session_id))
    end
  end
end
