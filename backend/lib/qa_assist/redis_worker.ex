defmodule QaAssist.RedisWorker do
  require Logger

  alias QaAssist.Analysis.Runner
  alias QaAssist.Recording

  @default_queue "qa_assist:analysis"

  def start_link(_opts) do
    Task.start_link(__MODULE__, :run, [])
  end

  def run do
    config = Application.get_env(:qa_assist, :redis, [])
    url = Keyword.get(config, :url, "redis://localhost:6379")
    queue = Keyword.get(config, :queue, @default_queue)

    {:ok, conn} = Redix.start_link(url)
    loop(conn, queue)
  end

  defp loop(conn, queue) do
    case Redix.command(conn, ["BRPOP", queue, "5"]) do
      {:ok, nil} ->
        :ok

      {:ok, [^queue, payload]} ->
        handle_payload(payload)

      {:ok, _} ->
        :ok

      {:error, reason} ->
        Logger.error("redis worker error: #{inspect(reason)}")
    end

    loop(conn, queue)
  end

  defp handle_payload(payload) when is_binary(payload) do
    case Jason.decode(payload) do
      {:ok, %{"type" => "chunk", "chunk_id" => chunk_id}} ->
        if chunk = Recording.get_chunk(chunk_id) do
          Runner.run_chunk(chunk)
        end

      {:ok, %{"type" => "session", "session_id" => session_id}} ->
        if session = Recording.get_session(session_id) do
          Runner.run_session(session)
        end

      {:ok, _} ->
        :ok

      {:error, reason} ->
        Logger.error("redis worker decode error: #{inspect(reason)}")
    end
  end
end
