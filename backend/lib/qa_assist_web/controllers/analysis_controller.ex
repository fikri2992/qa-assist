defmodule QaAssistWeb.AnalysisController do
  use QaAssistWeb, :controller

  alias QaAssist.Analysis
  alias QaAssistWeb.ControllerHelpers

  def show(conn, %{"id" => session_id}) do
    case ControllerHelpers.require_session(conn, session_id) do
      {:ok, _session} ->
        json(conn, Analysis.get_session_report(session_id))

      {:error, conn} ->
        conn
    end
  end
end
