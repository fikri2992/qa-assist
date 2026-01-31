# Script for populating the database. You can run it as:
#
#     mix run priv/repo/seeds.exs
#
# Inside the script, you can read and write to any of your
# repositories directly:
#
#     QaAssist.Repo.insert!(%QaAssist.SomeSchema{})
#
# We recommend using the bang functions (`insert!`, `update!`
# and so on) as they will fail if something goes wrong.

alias QaAssist.Accounts

email = System.get_env("QA_SEED_EMAIL", "demo@qaassist.local")
password = System.get_env("QA_SEED_PASSWORD", "demo123")

case Accounts.get_user_by_email(email) do
  nil ->
    {:ok, _user} = Accounts.create_user(email, password)
    IO.puts("Seeded user #{email}")

  _ ->
    IO.puts("Seed user #{email} already exists")
end
