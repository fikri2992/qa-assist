defmodule QaAssist.Recording.Session do
  use Ecto.Schema
  import Ecto.Changeset

  alias QaAssist.Devices.Device
  alias QaAssist.Recording.Chunk
  alias QaAssist.Recording.Event

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "sessions" do
    field :status, :string
    field :started_at, :utc_datetime_usec
    field :ended_at, :utc_datetime_usec
    field :idle_paused_at, :utc_datetime_usec
    field :metadata, :map

    belongs_to :device, Device
    has_many :chunks, Chunk
    has_many :events, Event

    timestamps(type: :utc_datetime_usec)
  end

  def changeset(session, attrs) do
    session
    |> cast(attrs, [:status, :started_at, :ended_at, :idle_paused_at, :metadata])
    |> validate_required([:status])
  end
end
