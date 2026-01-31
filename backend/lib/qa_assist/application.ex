defmodule QaAssist.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children =
      [
        QaAssistWeb.Telemetry,
        QaAssist.Repo,
        {DNSCluster, query: Application.get_env(:qa_assist, :dns_cluster_query) || :ignore},
        {Phoenix.PubSub, name: QaAssist.PubSub},
        {Task.Supervisor, name: QaAssist.TaskSupervisor},
        # Start a worker by calling: QaAssist.Worker.start_link(arg)
        # {QaAssist.Worker, arg},
        # Start to serve requests, typically the last entry
        QaAssistWeb.Endpoint
      ] ++ redis_children()

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: QaAssist.Supervisor]
    Supervisor.start_link(children, opts)
  end

  defp redis_children do
    config = Application.get_env(:qa_assist, :redis, [])

    if Keyword.get(config, :enabled, false) do
      redis_url = Keyword.get(config, :url, "redis://localhost:6379")

      [
        {Redix, name: QaAssist.Redis, url: redis_url},
        QaAssist.RedisWorker
      ]
    else
      []
    end
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    QaAssistWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
