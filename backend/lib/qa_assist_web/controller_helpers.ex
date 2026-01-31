defmodule QaAssistWeb.ControllerHelpers do
  import Plug.Conn
  import Phoenix.Controller

  alias QaAssist.Devices
  alias QaAssist.Recording

  def fetch_device_id(conn) do
    case get_req_header(conn, "x-device-id") do
      [device_id | _] -> device_id
      _ -> conn.params["device_id"]
    end
  end

  def fetch_device_secret(conn) do
    case get_req_header(conn, "x-device-secret") do
      [secret | _] -> secret
      _ -> conn.params["device_secret"]
    end
  end

  def require_device(conn) do
    device_id = fetch_device_id(conn)

    cond do
      is_nil(device_id) ->
        {:error, send_error(conn, 400, "device_id required")}

      true ->
        require_device_secret(conn, device_id)
    end
  end

  def require_session(conn, session_id) do
    case Recording.get_session(session_id) do
      nil ->
        {:error, send_error(conn, 404, "session not found")}

      session ->
        case require_device_secret(conn, session.device_id) do
          {:ok, _device} -> {:ok, session}
          {:error, conn} -> {:error, conn}
        end
    end
  end

  def require_chunk(conn, chunk_id) do
    case Recording.get_chunk(chunk_id) do
      nil ->
        {:error, send_error(conn, 404, "chunk not found")}

      chunk ->
        case Recording.get_session(chunk.session_id) do
          nil ->
            {:error, send_error(conn, 404, "session not found")}

          session ->
            case require_device_secret(conn, session.device_id) do
              {:ok, _device} -> {:ok, chunk}
              {:error, conn} -> {:error, conn}
            end
        end
    end
  end

  defp require_device_secret(conn, device_id) do
    secret = fetch_device_secret(conn)

    cond do
      is_nil(secret) ->
        {:error, send_error(conn, 401, "device_secret required")}

      device = Devices.verify_device(device_id, secret) ->
        {:ok, device}

      true ->
        {:error, send_error(conn, 401, "invalid device secret")}
    end
  end

  def send_error(conn, status, message) do
    conn
    |> put_status(status)
    |> json(%{error: message})
    |> halt()
  end
end
