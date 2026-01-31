defmodule QaAssistWeb.ArtifactController do
  use QaAssistWeb, :controller

  alias QaAssist.Artifacts
  alias QaAssistWeb.ControllerHelpers

  def index(conn, %{"id" => session_id}) do
    json(conn, Artifacts.list_artifacts(session_id))
  end

  def show(conn, %{"id" => artifact_id}) do
    case Artifacts.get_artifact(artifact_id) do
      {:ok, %{filename: filename, content_type: content_type, content: content}} ->
        conn
        |> put_resp_header("content-disposition", ~s(attachment; filename="#{filename}"))
        |> put_resp_content_type(content_type)
        |> send_resp(200, content)

      {:error, :not_found} ->
        ControllerHelpers.send_error(conn, 404, "artifact not found")
    end
  end
end
