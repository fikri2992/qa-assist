defmodule QaAssistWeb.AuthController do
  use QaAssistWeb, :controller

  alias QaAssist.Accounts
  alias QaAssistWeb.ControllerHelpers

  def login(conn, %{"email" => email, "password" => password}) do
    with {:ok, user} <- Accounts.authenticate(email, password),
         {:ok, token} <- Accounts.issue_token(user) do
      json(conn, %{token: token.token, user_id: user.id})
    else
      {:error, :invalid_credentials} ->
        ControllerHelpers.send_error(conn, 401, "invalid credentials")

      {:error, _} ->
        ControllerHelpers.send_error(conn, 400, "login failed")
    end
  end

  def login(conn, _params) do
    ControllerHelpers.send_error(conn, 400, "email and password required")
  end
end
