defmodule QaAssist.Artifacts do
  import Ecto.Query, only: [from: 2]

  alias QaAssist.Recording.Event
  alias QaAssist.Recording.Session
  alias QaAssist.Repo

  def list_artifacts(session_id) do
    case Repo.get(Session, session_id) do
      nil ->
        []

      _session ->
        [
          %{
            id: "playwright-#{session_id}",
            name: "Playwright repro script",
            kind: "playwright",
            format: "js",
            description: "Generated from interaction events"
          }
        ]
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

  def get_artifact(_), do: {:error, :not_found}

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
end
