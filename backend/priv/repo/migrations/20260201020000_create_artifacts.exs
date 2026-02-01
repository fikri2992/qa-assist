defmodule QaAssist.Repo.Migrations.CreateArtifacts do
  use Ecto.Migration

  def change do
    create table(:artifacts, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :session_id, references(:sessions, type: :binary_id, on_delete: :delete_all),
        null: false
      add :kind, :string, null: false
      add :name, :string, null: false
      add :format, :string
      add :description, :text
      add :content_type, :string
      add :gcs_uri, :string
      add :byte_size, :integer
      add :status, :string
      add :metadata, :map

      timestamps(type: :utc_datetime_usec)
    end

    create index(:artifacts, [:session_id])
    create unique_index(:artifacts, [:session_id, :kind])
  end
end
