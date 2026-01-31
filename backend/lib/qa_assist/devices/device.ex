defmodule QaAssist.Devices.Device do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "devices" do
    field :metadata, :map
    field :last_seen, :utc_datetime_usec

    timestamps(type: :utc_datetime_usec)
  end

  def changeset(device, attrs) do
    device
    |> cast(attrs, [:metadata, :last_seen])
  end
end
