# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

config :qa_assist,
  ecto_repos: [QaAssist.Repo],
  generators: [timestamp_type: :utc_datetime, binary_id: true]

config :qa_assist, :storage,
  backend: QaAssist.Storage.Local,
  local_path: "priv/static/storage"

config :qa_assist, :analysis_service, url: "http://localhost:8000"

# Configure the endpoint
config :qa_assist, QaAssistWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [json: QaAssistWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: QaAssist.PubSub,
  live_view: [signing_salt: "DAUW5gAQ"]

# Configure Elixir's Logger
config :logger, :default_formatter,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
