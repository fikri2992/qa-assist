defmodule QaAssist.Analysis.Analysis do
  use Ecto.Schema
  import Ecto.Changeset

  alias QaAssist.Recording.Chunk
  alias QaAssist.Recording.Session

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "analyses" do
    field :status, :string
    field :report, :map

    belongs_to :session, Session
    belongs_to :chunk, Chunk

    timestamps(type: :utc_datetime_usec)
  end

  def changeset(analysis, attrs) do
    analysis
    |> cast(attrs, [:status, :report])
    |> validate_required([:status, :report])
  end
end
