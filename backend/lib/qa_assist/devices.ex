defmodule QaAssist.Devices do
  import Ecto.Query, only: [from: 2]

  alias QaAssist.Devices.Device
  alias QaAssist.Repo

  def create_device(metadata \\ %{}) when is_map(metadata) do
    secret = generate_secret()

    %Device{}
    |> Device.changeset(%{
      metadata: metadata,
      last_seen: DateTime.utc_now(),
      secret: secret
    })
    |> Repo.insert()
  end

  def get_device(id) do
    Repo.get(Device, id)
  end

  def verify_device(id, secret) when is_binary(secret) do
    Repo.get_by(Device, id: id, secret: secret)
  end

  def verify_device(_id, _secret), do: nil

  def touch_device(%Device{} = device) do
    device
    |> Device.changeset(%{last_seen: DateTime.utc_now()})
    |> Repo.update()
  end

  def list_devices do
    from(d in Device, order_by: [desc: d.inserted_at])
    |> Repo.all()
  end

  defp generate_secret do
    24
    |> :crypto.strong_rand_bytes()
    |> Base.url_encode64(padding: false)
  end
end
