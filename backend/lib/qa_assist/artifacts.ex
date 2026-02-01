defmodule QaAssist.Artifacts do
  import Ecto.Query, only: [from: 2]

  alias QaAssist.Storage
  alias QaAssist.Recording.Event
  alias QaAssist.Recording.Session
  alias QaAssist.Repo

  def list_artifacts(session_id) do
    case Repo.get(Session, session_id) do
      nil ->
        []

      _session ->
        base = [
          %{
            id: "playwright-#{session_id}",
            name: "Playwright repro script",
            kind: "playwright",
            format: "js",
            description: "Generated from interaction events"
          }
        ]

        if session_json_available?(session_id) do
          [
            %{
              id: "session-json-#{session_id}",
              name: "Session events",
              kind: "session-json",
              format: "json",
              description: "Captured console, network, and interaction events"
            }
            | base
          ]
        else
          base
        end
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

  def get_artifact("session-json-" <> session_id) do
    case Repo.get(Session, session_id) do
      nil ->
        {:error, :not_found}

      _session ->
        if Storage.backend_module() == QaAssist.Storage.Gcs do
          gcs_uri = session_json_uri(session_id)
          case Storage.media_url(gcs_uri) do
            nil ->
              {:error, :not_found}

            url ->
              case Req.get(url) do
                {:ok, %{status: 200, body: body}} ->
                  {:ok,
                   %{
                     filename: "session-#{session_id}.json",
                     content_type: "application/json",
                     content: body
                   }}

                _ ->
                  {:error, :not_found}
              end
          end
        else
          path = session_json_path(session_id)
          case File.read(path) do
            {:ok, content} ->
              {:ok,
               %{
                 filename: "session-#{session_id}.json",
                 content_type: "application/json",
                 content: content
               }}

            _ ->
              {:error, :not_found}
          end
        end
    end
  end

  def get_artifact(_), do: {:error, :not_found}

  def store_session_json(session_id, payload) do
    content = Jason.encode!(payload, pretty: true)

    if Storage.backend_module() == QaAssist.Storage.Gcs do
      object = session_json_object(session_id)
      upload = QaAssist.Storage.Gcs.prepare_object_upload(object, "application/json")

      case Req.put(upload.upload_url, body: content, headers: Map.to_list(upload.upload_headers || %{})) do
        {:ok, %{status: status}} when status in [200, 201] ->
          {:ok, %{id: "session-json-#{session_id}", gcs_uri: upload.gcs_uri}}

        {:ok, %{status: status, body: body}} ->
          {:error, "upload failed (status #{status}): #{body}"}

        {:error, reason} ->
          {:error, "upload failed: #{inspect(reason)}"}
      end
    else
      path = session_json_path(session_id)
      File.mkdir_p!(Path.dirname(path))

      case File.write(path, content) do
        :ok -> {:ok, %{id: "session-json-#{session_id}", path: path}}
        {:error, reason} -> {:error, "file write failed: #{inspect(reason)}"}
      end
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

  defp session_json_available?(session_id) do
    if Storage.backend_module() == QaAssist.Storage.Gcs do
      true
    else
      File.exists?(session_json_path(session_id))
    end
  end

  defp session_json_object(session_id) do
    "artifacts/session-#{session_id}.json"
  end

  defp session_json_uri(session_id) do
    config = Application.get_env(:qa_assist, :storage, [])
    gcs = Keyword.get(config, :gcs, [])
    bucket = Keyword.get(gcs, :bucket)
    "gs://#{bucket}/#{session_json_object(session_id)}"
  end

  defp session_json_path(session_id) do
    base_dir =
      :code.priv_dir(:qa_assist)
      |> to_string()
      |> Path.join(["static", "storage", "artifacts"])

    Path.join(base_dir, "session-#{session_id}.json")
  end
end
