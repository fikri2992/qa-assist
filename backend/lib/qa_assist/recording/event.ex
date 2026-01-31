defmodule QaAssist.Recording.Event do
  use Ecto.Schema
  import Ecto.Changeset

  alias QaAssist.Recording.Session

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "events" do
    field :ts, :utc_datetime_usec
    field :type, :string
    field :payload, :map

    belongs_to :session, Session
  end

  def changeset(event, attrs) do
    event
    |> cast(attrs, [:ts, :type, :payload])
    |> validate_required([:ts, :type, :payload])
  end
end
