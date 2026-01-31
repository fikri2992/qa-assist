defmodule QaAssistWeb.RootController do
  use QaAssistWeb, :controller

  def index(conn, _params) do
    json(conn, %{message: "QA Assist API", status: "ok"})
  end
end
