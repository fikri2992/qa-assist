defmodule QaAssist.Recording.Chunk do
  use Ecto.Schema
  import Ecto.Changeset

  alias QaAssist.Recording.Session
  alias QaAssist.Analysis.Analysis

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "chunks" do
    field :idx, :integer
    field :start_ts, :utc_datetime_usec
    field :end_ts, :utc_datetime_usec
    field :gcs_uri, :string
    field :status, :string
    field :analysis_status, :string
    field :content_type, :string
    field :byte_size, :integer

    belongs_to :session, Session
    has_many :analyses, Analysis

    timestamps(type: :utc_datetime_usec)
  end

  def changeset(chunk, attrs) do
    chunk
    |> cast(attrs, [
      :idx,
      :start_ts,
      :end_ts,
      :gcs_uri,
      :status,
      :analysis_status,
      :content_type,
      :byte_size
    ])
    |> validate_required([:idx, :status, :analysis_status])
  end
end
