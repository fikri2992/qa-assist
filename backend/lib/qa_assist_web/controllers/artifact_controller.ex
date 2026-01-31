defmodule QaAssistWeb.ArtifactController do
  use QaAssistWeb, :controller

  def index(conn, _params) do
    json(conn, [])
  end

  def show(conn, _params) do
    conn
    |> put_status(404)
    |> json(%{error: "artifact not found"})
  end
end
