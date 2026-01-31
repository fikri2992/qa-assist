defmodule QaAssist.Analysis do
  import Ecto.Query, only: [from: 2]

  alias QaAssist.Analysis.Analysis
  alias QaAssist.Analysis.Runner
  alias QaAssist.Recording.Chunk
  alias QaAssist.Repo

  def enqueue_chunk(%Chunk{} = chunk) do
    Task.Supervisor.start_child(QaAssist.TaskSupervisor, fn ->
      Runner.run_chunk(chunk)
    end)

    :ok
  end

  def record_chunk_running(%Chunk{} = chunk) do
    chunk
    |> Ecto.Changeset.change(%{analysis_status: "running"})
    |> Repo.update()
  end

  def record_chunk_report(%Chunk{} = chunk, report) when is_map(report) do
    Repo.transaction(fn ->
      Repo.insert!(%Analysis{
        session_id: chunk.session_id,
        chunk_id: chunk.id,
        status: "done",
        report: report
      })

      chunk
      |> Ecto.Changeset.change(%{analysis_status: "done"})
      |> Repo.update!()
    end)

    :ok
  end

  def record_chunk_failure(%Chunk{} = chunk, reason) do
    Repo.transaction(fn ->
      Repo.insert!(%Analysis{
        session_id: chunk.session_id,
        chunk_id: chunk.id,
        status: "failed",
        report: %{error: reason}
      })

      chunk
      |> Ecto.Changeset.change(%{analysis_status: "failed"})
      |> Repo.update!()
    end)

    :ok
  end

  def get_session_report(session_id) do
    analyses =
      from(a in Analysis, where: a.session_id == ^session_id, order_by: [asc: a.inserted_at])
      |> Repo.all()

    %{
      session_id: session_id,
      status: session_status(analyses),
      summary: build_summary(analyses),
      analyses: Enum.map(analyses, &analysis_payload/1)
    }
  end

  defp session_status([]), do: "pending"

  defp session_status(analyses) do
    if Enum.any?(analyses, &(&1.status == "failed")) do
      "failed"
    else
      "done"
    end
  end

  defp build_summary([]), do: "No analysis available yet."

  defp build_summary(analyses) do
    issue_count =
      analyses
      |> Enum.flat_map(fn analysis -> Map.get(analysis.report || %{}, "issues", []) end)
      |> Enum.count()

    "#{issue_count} potential issues detected across #{length(analyses)} chunks."
  end

  defp analysis_payload(%Analysis{} = analysis) do
    %{
      id: analysis.id,
      session_id: analysis.session_id,
      chunk_id: analysis.chunk_id,
      status: analysis.status,
      report: analysis.report,
      created_at: analysis.inserted_at
    }
  end
end
