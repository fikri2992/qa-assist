defmodule QaAssist.Artifacts do
  import Ecto.Query, only: [from: 2]

  alias QaAssist.Storage
  alias QaAssist.Recording
  alias QaAssist.Recording.Artifact
  alias QaAssist.Recording.Event
  alias QaAssist.Recording.Session
  alias QaAssist.Repo

  def list_artifacts(session_id) do
    case Repo.get(Session, session_id) do
      nil ->
        []

      _session ->
        stored =
          from(a in Artifact,
            where: a.session_id == ^session_id,
            order_by: [desc: a.inserted_at]
          )
          |> Repo.all()

        {session_json, other} = Enum.split_with(stored, &(&1.kind == "session-json"))

        session_json_entry =
          case session_json do
            [artifact | _] -> artifact_payload(artifact)
            [] -> missing_session_json(session_id)
          end

        stored_entries =
          other
          |> Enum.map(&artifact_payload/1)

        playwright = %{
          id: "playwright-#{session_id}",
          name: "Playwright repro script",
          kind: "playwright",
          format: "js",
          description: "Generated from interaction events"
        }

        [session_json_entry, playwright | stored_entries]
    end
  end

  def get_artifact("playwright-" <> session_id) do
    case Repo.get(Session, session_id) do
      nil ->
        {:error, :not_found}

      session ->
        events =
          from(e in Event,
            where:
              e.session_id == ^session_id and e.type in ["interaction", "marker", "annotation"],
            order_by: [asc: e.ts]
          )
          |> Repo.all()

        {:ok,
         %{
           filename: "repro-#{session_id}.spec.js",
           content_type: "text/javascript",
           content: build_playwright_script(session, events)
         }}
    end
  end

  def get_artifact(id) do
    case Repo.get(Artifact, id) do
      nil -> {:error, :not_found}
      artifact -> {:ok, artifact}
    end
  end

  def get_artifact(_), do: {:error, :not_found}

  def store_session_json(session_id, payload) do
    content = Jason.encode!(payload, pretty: true)
    byte_size = byte_size(content)

    upload =
      if Storage.backend_module() == QaAssist.Storage.Gcs do
        object = session_json_object(session_id)
        upload = QaAssist.Storage.Gcs.prepare_object_upload(object, "application/json")

        case Req.put(upload.upload_url, body: content, headers: Map.to_list(upload.upload_headers || %{})) do
          {:ok, %{status: status}} when status in [200, 201] ->
            {:ok, upload.gcs_uri}

          {:ok, %{status: status, body: body}} ->
            {:error, "upload failed (status #{status}): #{body}"}

          {:error, reason} ->
            {:error, "upload failed: #{inspect(reason)}"}
        end
      else
        path = session_json_path(session_id)
        File.mkdir_p!(Path.dirname(path))

        case File.write(path, content) do
          :ok -> {:ok, "/storage/artifacts/session-#{session_id}.json"}
          {:error, reason} -> {:error, "file write failed: #{inspect(reason)}"}
        end
      end

    case upload do
      {:ok, gcs_uri} ->
        upsert_artifact(%{
          session_id: session_id,
          kind: "session-json",
          name: "Session events",
          format: "json",
          description: "Captured console, network, and interaction events",
          content_type: "application/json",
          gcs_uri: gcs_uri,
          byte_size: byte_size,
          status: "ready"
        })

      {:error, reason} ->
        {:error, reason}
    end
  end

  def rebuild_session_json(session_id) do
    case Repo.get(Session, session_id) do
      nil ->
        {:error, :not_found}

      session ->
        events = Recording.list_events_all(session_id)
        payload = build_session_payload(session, events)
        store_session_json(session_id, payload)
    end
  end

  defp build_playwright_script(session, events) do
    url = session.metadata |> Map.get("url", "about:blank") |> sanitize_string()

    steps =
      events
      |> Enum.map(&event_to_step/1)
      |> Enum.reject(&is_nil/1)

    lines =
      [
        "import { test, expect } from '@playwright/test';",
        "",
        "test('qa assist repro', async ({ page }) => {",
        "  await page.goto(\"#{url}\");"
      ] ++
        steps ++
        ["});", ""]

    Enum.join(lines, "\n")
  end

  defp event_to_step(%Event{type: "marker"} = event) do
    payload = event.payload || %{}
    label = payload["label"] || payload[:label] || payload["message"] || payload[:message]
    if label, do: "  // Marker: #{sanitize_string(label)}", else: nil
  end

  defp event_to_step(%Event{type: "annotation"} = event) do
    payload = event.payload || %{}
    text = payload["text"] || payload[:text]
    if text, do: "  // Annotation: #{sanitize_string(text)}", else: nil
  end

  defp event_to_step(%Event{type: "interaction"} = event) do
    payload = event.payload || %{}
    selector = payload["selector"] || payload[:selector]
    action = payload["action"] || payload[:action]

    case action do
      "click" ->
        "  await page.click(\"#{sanitize_string(selector)}\");"

      "keydown" ->
        key = payload["key"] || payload[:key]

        if key do
          "  await page.keyboard.press(\"#{sanitize_string(key)}\");"
        else
          nil
        end

      "scroll" ->
        scroll_y = payload["scrollY"] || payload[:scrollY]
        scroll_x = payload["scrollX"] || payload[:scrollX]

        if is_number(scroll_y) or is_number(scroll_x) do
          "  await page.evaluate(() => window.scrollTo(#{scroll_x || 0}, #{scroll_y || 0}));"
        else
          nil
        end

      _ ->
        nil
    end
  end

  defp event_to_step(_), do: nil

  defp sanitize_string(nil), do: ""

  defp sanitize_string(value) do
    value
    |> to_string()
    |> String.replace("\\", "\\\\")
    |> String.replace("\"", "\\\"")
  end

  defp session_json_object(session_id) do
    "artifacts/session-#{session_id}.json"
  end

  defp session_json_path(session_id) do
    base_dir =
      :code.priv_dir(:qa_assist)
      |> to_string()
      |> Path.join(["static", "storage", "artifacts"])

    Path.join(base_dir, "session-#{session_id}.json")
  end

  defp upsert_artifact(attrs) do
    changeset = Artifact.changeset(%Artifact{}, attrs)

    Repo.insert(changeset,
      on_conflict: {:replace, [:name, :format, :description, :content_type, :gcs_uri, :byte_size, :status, :metadata, :updated_at]},
      conflict_target: [:session_id, :kind]
    )
    |> case do
      {:ok, artifact} -> {:ok, artifact_payload(artifact)}
      {:error, changeset} -> {:error, changeset}
    end
  end

  defp artifact_payload(%Artifact{} = artifact) do
    %{
      id: artifact.id,
      name: artifact.name,
      kind: artifact.kind,
      format: artifact.format,
      description: artifact.description,
      content_type: artifact.content_type,
      gcs_uri: artifact.gcs_uri,
      byte_size: artifact.byte_size,
      status: artifact.status,
      inserted_at: artifact.inserted_at
    }
  end

  defp missing_session_json(session_id) do
    %{
      id: nil,
      session_id: session_id,
      name: "Session events",
      kind: "session-json",
      format: "json",
      description: "Captured console, network, and interaction events",
      content_type: "application/json",
      gcs_uri: nil,
      byte_size: nil,
      status: "missing",
      inserted_at: nil
    }
  end

  defp build_session_payload(%Session{} = session, events) when is_list(events) do
    metadata = session.metadata || %{}

    %{
      session: %{
        id: session.id,
        started_at: session.started_at,
        ended_at: session.ended_at,
        url: metadata["url"] || metadata[:url],
        title: metadata["title"] || metadata[:title],
        metadata: metadata
      },
      events: Enum.map(events, &event_payload/1)
    }
  end

  defp event_payload(%Event{} = event) do
    %{
      ts: event.ts,
      type: event.type,
      payload: event.payload
    }
  end
end
