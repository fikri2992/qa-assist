defmodule QaAssistWeb.DeviceController do
  use QaAssistWeb, :controller

  alias QaAssist.Devices
  alias QaAssistWeb.ControllerHelpers

  def create(conn, params) do
    metadata = Map.get(params, "metadata", %{})

    case Devices.create_device(metadata) do
      {:ok, device} ->
        json(conn, %{device_id: device.id, device_secret: device.secret})

      {:error, _changeset} ->
        ControllerHelpers.send_error(conn, 400, "failed to create device")
    end
  end
end
