defmodule QaAssistWeb.AiHealthController do
  use QaAssistWeb, :controller

  alias QaAssist.AI
  alias QaAssistWeb.ControllerHelpers

  def show(conn, _params) do
    with {:ok, _user} <- ControllerHelpers.require_user(conn),
         {:ok, payload} <- AI.health() do
      json(conn, payload)
    else
      {:error, conn} -> conn
      {:error, reason} -> ControllerHelpers.send_error(conn, 502, reason)
    end
  end
end
