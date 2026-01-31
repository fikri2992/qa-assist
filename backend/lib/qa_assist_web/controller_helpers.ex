defmodule QaAssistWeb.ControllerHelpers do
  import Plug.Conn
  import Phoenix.Controller

  alias QaAssist.Accounts
  alias QaAssist.Devices
  alias QaAssist.Recording

  def fetch_device_id(conn) do
    case get_req_header(conn, "x-device-id") do
      [device_id | _] -> device_id
      _ -> conn.params["device_id"]
    end
  end

  def fetch_auth_token(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token | _] -> token
      [token | _] -> token
      _ -> conn.params["auth_token"]
    end
  end

  def require_user(conn) do
    case fetch_auth_token(conn) do
      nil ->
        {:error, send_error(conn, 401, "auth token required")}

      token ->
        case Accounts.get_user_by_token(token) do
          nil -> {:error, send_error(conn, 401, "invalid auth token")}
          user -> {:ok, user}
        end
    end
  end

  def require_device(conn) do
    with {:ok, user} <- require_user(conn) do
      device_id = fetch_device_id(conn)

      cond do
        is_nil(device_id) ->
          {:error, send_error(conn, 400, "device_id required")}

        device = Devices.get_device(device_id) ->
          case ensure_device_owner(conn, device, user) do
            {:ok, updated} ->
              _ = Devices.touch_device(updated)
              {:ok, updated}

            {:error, conn} ->
              {:error, conn}
          end

        true ->
          {:error, send_error(conn, 404, "device not found")}
      end
    end
  end

  def require_session(conn, session_id) do
    case Recording.get_session_with_device(session_id) do
      nil ->
        {:error, send_error(conn, 404, "session not found")}

      session ->
        with {:ok, user} <- require_user(conn) do
          case session.device do
            nil ->
              {:error, send_error(conn, 404, "device not found")}

            device ->
              case ensure_device_owner(conn, device, user) do
                {:ok, _} -> {:ok, session}
                {:error, conn} -> {:error, conn}
              end
          end
        end
    end
  end

  def require_chunk(conn, chunk_id) do
    case Recording.get_chunk(chunk_id) do
      nil ->
        {:error, send_error(conn, 404, "chunk not found")}

      chunk ->
        case Recording.get_session_with_device(chunk.session_id) do
          nil ->
            {:error, send_error(conn, 404, "session not found")}

          session ->
            with {:ok, user} <- require_user(conn) do
              case session.device do
                nil ->
                  {:error, send_error(conn, 404, "device not found")}

                device ->
                  case ensure_device_owner(conn, device, user) do
                    {:ok, _} -> {:ok, chunk}
                    {:error, conn} -> {:error, conn}
                  end
              end
            end
        end
    end
  end

  defp ensure_device_owner(conn, device, user) do
    cond do
      device.user_id == user.id ->
        {:ok, device}

      is_nil(device.user_id) ->
        case Devices.set_user(device, user.id) do
          {:ok, updated} -> {:ok, updated}
          {:error, _} -> {:error, send_error(conn, 500, "device update failed")}
        end

      true ->
        {:error, send_error(conn, 403, "device does not belong to user")}
    end
  end

  def send_error(conn, status, message) do
    conn
    |> put_status(status)
    |> json(%{error: message})
    |> halt()
  end
end
