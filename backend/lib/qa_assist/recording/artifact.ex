defmodule QaAssist.Recording.Artifact do
  use Ecto.Schema
  import Ecto.Changeset

  alias QaAssist.Recording.Session

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "artifacts" do
    field :kind, :string
    field :name, :string
    field :format, :string
    field :description, :string
    field :content_type, :string
    field :gcs_uri, :string
    field :byte_size, :integer
    field :status, :string
    field :metadata, :map

    belongs_to :session, Session

    timestamps(type: :utc_datetime_usec)
  end

  def changeset(artifact, attrs) do
    artifact
    |> cast(attrs, [
      :session_id,
      :kind,
      :name,
      :format,
      :description,
      :content_type,
      :gcs_uri,
      :byte_size,
      :status,
      :metadata
    ])
    |> validate_required([:session_id, :kind, :name])
  end
end
