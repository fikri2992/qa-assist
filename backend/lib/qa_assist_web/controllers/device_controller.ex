defmodule QaAssistWeb.DeviceController do
  use QaAssistWeb, :controller

  alias QaAssist.Devices
  alias QaAssistWeb.ControllerHelpers

  def create(conn, params) do
    metadata = Map.get(params, "metadata", %{})

    with {:ok, user} <- ControllerHelpers.require_user(conn) do
      case Devices.create_device(user.id, metadata) do
        {:ok, device} ->
          json(conn, %{device_id: device.id})

        {:error, _changeset} ->
          ControllerHelpers.send_error(conn, 400, "failed to create device")
      end
    end
  end
end
