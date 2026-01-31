defmodule QaAssist.Devices do
  import Ecto.Query, only: [from: 2]

  alias QaAssist.Devices.Device
  alias QaAssist.Repo

  def create_device(metadata \\ %{}) when is_map(metadata) do
    %Device{}
    |> Device.changeset(%{metadata: metadata, last_seen: DateTime.utc_now()})
    |> Repo.insert()
  end

  def get_device(id) do
    Repo.get(Device, id)
  end

  def touch_device(%Device{} = device) do
    device
    |> Device.changeset(%{last_seen: DateTime.utc_now()})
    |> Repo.update()
  end

  def list_devices do
    from(d in Device, order_by: [desc: d.inserted_at])
    |> Repo.all()
  end
end
