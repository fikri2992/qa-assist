defmodule QaAssist.Repo.Migrations.AddUserIdToDevices do
  use Ecto.Migration

  def change do
    alter table(:devices) do
      add :user_id, references(:users, type: :binary_id, on_delete: :nilify_all)
    end

    create index(:devices, [:user_id])
  end
end
