defmodule QaAssistWeb.CORS do
  @moduledoc false

  import Plug.Conn

  @allowed_methods "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  @allowed_headers "authorization,content-type"

  def init(opts), do: opts

  def call(conn, _opts) do
    origin = get_req_header(conn, "origin") |> List.first()

    conn =
      conn
      |> put_resp_header("access-control-allow-origin", origin || "*")
      |> put_resp_header("access-control-allow-methods", @allowed_methods)
      |> put_resp_header("access-control-allow-headers", @allowed_headers)

    if conn.method == "OPTIONS" do
      conn
      |> send_resp(204, "")
      |> halt()
    else
      conn
    end
  end
end
