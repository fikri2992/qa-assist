defmodule QaAssistWeb.ControllerHelpers do
  import Plug.Conn
  import Phoenix.Controller

  def fetch_device_id(conn) do
    case get_req_header(conn, "x-device-id") do
      [device_id | _] -> device_id
      _ -> conn.params["device_id"]
    end
  end

  def send_error(conn, status, message) do
    conn
    |> put_status(status)
    |> json(%{error: message})
    |> halt()
  end
end
