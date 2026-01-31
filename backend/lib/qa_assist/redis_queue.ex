defmodule QaAssist.RedisQueue do
  @default_queue "qa_assist:analysis"

  def enabled? do
    config = Application.get_env(:qa_assist, :redis, [])
    Keyword.get(config, :enabled, false)
  end

  def queue_name do
    config = Application.get_env(:qa_assist, :redis, [])
    Keyword.get(config, :queue, @default_queue)
  end

  def enqueue(job) when is_map(job) do
    if enabled?() do
      payload = Jason.encode!(job)
      Redix.command(QaAssist.Redis, ["LPUSH", queue_name(), payload])
      :ok
    else
      :disabled
    end
  end
end
