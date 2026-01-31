defmodule QaAssist.Repo do
  use Ecto.Repo,
    otp_app: :qa_assist,
    adapter: Ecto.Adapters.Postgres
end
