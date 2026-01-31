defmodule QaAssist.Repo.Migrations.CreateRecordingTables do
  use Ecto.Migration

  def change do
    create table(:devices, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :metadata, :map
      add :last_seen, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create table(:sessions, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :device_id, references(:devices, type: :binary_id, on_delete: :delete_all), null: false
      add :status, :string, null: false
      add :started_at, :utc_datetime_usec
      add :ended_at, :utc_datetime_usec
      add :idle_paused_at, :utc_datetime_usec
      add :metadata, :map

      timestamps(type: :utc_datetime_usec)
    end

    create index(:sessions, [:device_id])

    create table(:chunks, primary_key: false) do
      add :id, :binary_id, primary_key: true

      add :session_id, references(:sessions, type: :binary_id, on_delete: :delete_all),
        null: false

      add :idx, :integer, null: false
      add :start_ts, :utc_datetime_usec
      add :end_ts, :utc_datetime_usec
      add :gcs_uri, :string
      add :status, :string, null: false
      add :analysis_status, :string, null: false
      add :content_type, :string
      add :byte_size, :integer

      timestamps(type: :utc_datetime_usec)
    end

    create index(:chunks, [:session_id])
    create unique_index(:chunks, [:session_id, :idx])

    create table(:events, primary_key: false) do
      add :id, :binary_id, primary_key: true

      add :session_id, references(:sessions, type: :binary_id, on_delete: :delete_all),
        null: false

      add :ts, :utc_datetime_usec, null: false
      add :type, :string, null: false
      add :payload, :map, null: false
    end

    create index(:events, [:session_id])
    create index(:events, [:session_id, :ts])

    create table(:analyses, primary_key: false) do
      add :id, :binary_id, primary_key: true

      add :session_id, references(:sessions, type: :binary_id, on_delete: :delete_all),
        null: false

      add :chunk_id, references(:chunks, type: :binary_id, on_delete: :delete_all)
      add :status, :string, null: false
      add :report, :map, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create index(:analyses, [:session_id])
    create index(:analyses, [:chunk_id])
  end
end
