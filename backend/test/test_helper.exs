ExUnit.start()
ExUnit.configure(exclude: [:gcs])
Ecto.Adapters.SQL.Sandbox.mode(QaAssist.Repo, :manual)
