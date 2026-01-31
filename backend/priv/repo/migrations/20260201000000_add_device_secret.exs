defmodule QaAssist.Repo.Migrations.AddDeviceSecret do
  use Ecto.Migration

  def change do
    alter table(:devices) do
      add :secret, :string
    end

    create unique_index(:devices, [:secret])
  end
end
