// A11yUnityExporter.cs
// 유니티 키오스크 UI 계층을 베리어프리 분석 플랫폼이 받는 JSON 으로 export 한다.
// 결과 JSON 을 플레이그라운드 "Unity" 탭에 붙여넣거나 unityExportToA11yNodes() 로 분석한다.
//
// 설치:
//   1) 이 파일을 프로젝트의 Assets/Editor/ 폴더에 둔다(에디터 메뉴용).
//   2) TextMeshPro 를 쓰면 Player Settings → Scripting Define Symbols 에 TMP_PRESENT 추가.
//   3) 메뉴 Tools ▸ A11y ▸ Export UI JSON 실행.
//      - GameObject(예: Canvas)를 선택하고 실행하면 그 하위만, 선택이 없으면 씬의 모든 Canvas.
//      - 파일로 저장 + 클립보드에도 복사된다.
//
// 좌표·폰트는 화면 픽셀로 환산해 출력하므로(터치 타깃·대비 판정에 직결) 런타임 해상도에서
// 실행하면 가장 정확하다. 색은 hex, 비활성(active=false) 노드는 제외한다.

using System.Collections.Generic;
using System.Globalization;
using System.Text;
using UnityEngine;
using UnityEngine.UI;
#if TMP_PRESENT
using TMPro;
#endif
#if UNITY_EDITOR
using UnityEditor;
#endif

public static class A11yUnityExporter
{
    /// <summary>root 가 null 이면 씬의 모든 루트 Canvas 를, 아니면 그 하위를 export.</summary>
    public static string Export(GameObject root = null)
    {
        var roots = new List<Transform>();
        if (root != null)
        {
            roots.Add(root.transform);
        }
        else
        {
            foreach (var c in Object.FindObjectsOfType<Canvas>(true))
                if (c.isRootCanvas) roots.Add(c.transform);
        }

        var sb = new StringBuilder();
        sb.Append("{\"screenBg\":\"#ffffff\",\"nodes\":[");
        bool first = true;
        foreach (var t in roots)
        {
            if (!t.gameObject.activeInHierarchy) continue;
            if (!first) sb.Append(',');
            WriteNode(t, sb);
            first = false;
        }
        sb.Append("]}");
        return sb.ToString();
    }

    static void WriteNode(Transform t, StringBuilder sb)
    {
        var go = t.gameObject;
        var rt = t as RectTransform;

        sb.Append('{');
        Str(sb, "id", SafeId(t)); sb.Append(',');
        Str(sb, "name", go.name); sb.Append(',');
        Str(sb, "kind", KindOf(go));

        // 텍스트/전경색/폰트
        string text, colorHex; int fontPx; bool bold;
        if (TryReadText(go, t, out text, out colorHex, out fontPx, out bold))
        {
            sb.Append(','); Str(sb, "text", text);
            if (colorHex != null) { sb.Append(','); Str(sb, "color", colorHex); }
            if (fontPx > 0) { sb.Append(",\"fontSizePx\":"); sb.Append(fontPx); }
            if (bold) sb.Append(",\"fontStyle\":\"Bold\"");
        }

        // 배경색 (Image/RawImage/Graphic)
        string bg = ReadBackground(go);
        if (bg != null) { sb.Append(','); Str(sb, "backgroundColor", bg); }

        // 상호작용/포커스
        var sel = go.GetComponent<Selectable>();
        if (sel != null)
        {
            sb.Append(",\"interactable\":"); sb.Append(sel.interactable ? "true" : "false");
            sb.Append(",\"hasFocusVisual\":"); sb.Append(sel.transition != Selectable.Transition.None ? "true" : "false");
        }

        // 크기(화면 픽셀)
        if (rt != null)
        {
            int w = Mathf.RoundToInt(Mathf.Abs(rt.rect.width * rt.lossyScale.x));
            int h = Mathf.RoundToInt(Mathf.Abs(rt.rect.height * rt.lossyScale.y));
            sb.Append(",\"rect\":{\"width\":"); sb.Append(w); sb.Append(",\"height\":"); sb.Append(h); sb.Append('}');
        }

        // 자식 (활성 UI 만)
        var kids = new List<Transform>();
        for (int i = 0; i < t.childCount; i++)
        {
            var c = t.GetChild(i);
            if (c.gameObject.activeInHierarchy) kids.Add(c);
        }
        if (kids.Count > 0)
        {
            sb.Append(",\"children\":[");
            for (int i = 0; i < kids.Count; i++)
            {
                if (i > 0) sb.Append(',');
                WriteNode(kids[i], sb);
            }
            sb.Append(']');
        }

        sb.Append('}');
    }

    // GameObject 종류 → kind 문자열
    static string KindOf(GameObject go)
    {
#if TMP_PRESENT
        if (go.GetComponent<TMP_InputField>() != null) return "InputField";
#endif
        if (go.GetComponent<InputField>() != null) return "InputField";
        if (go.GetComponent<Button>() != null) return "Button";
        if (go.GetComponent<Toggle>() != null) return "Toggle";
#if TMP_PRESENT
        if (go.GetComponent<TMP_Text>() != null) return "TMP_Text";
#endif
        if (go.GetComponent<Text>() != null) return "Text";
        if (go.GetComponent<RawImage>() != null) return "RawImage";
        if (go.GetComponent<Image>() != null) return "Image";
        if (go.GetComponent<Canvas>() != null) return "Canvas";
        return "Panel";
    }

    // 텍스트 컴포넌트(legacy Text / TMP)에서 글자·색·폰트 추출
    static bool TryReadText(GameObject go, Transform t, out string text, out string colorHex, out int fontPx, out bool bold)
    {
        text = null; colorHex = null; fontPx = 0; bold = false;
#if TMP_PRESENT
        var tmp = go.GetComponent<TMP_Text>();
        if (tmp != null && !string.IsNullOrEmpty(tmp.text))
        {
            text = tmp.text;
            colorHex = "#" + ColorUtility.ToHtmlStringRGB(tmp.color);
            fontPx = Mathf.RoundToInt(tmp.fontSize * Mathf.Abs(t.lossyScale.y));
            bold = (tmp.fontStyle & FontStyles.Bold) != 0;
            return true;
        }
#endif
        var ui = go.GetComponent<Text>();
        if (ui != null && !string.IsNullOrEmpty(ui.text))
        {
            text = ui.text;
            colorHex = "#" + ColorUtility.ToHtmlStringRGB(ui.color);
            fontPx = Mathf.RoundToInt(ui.fontSize * Mathf.Abs(t.lossyScale.y));
            bold = ui.fontStyle == FontStyle.Bold || ui.fontStyle == FontStyle.BoldAndItalic;
            return true;
        }
        return false;
    }

    // 배경색: Image/RawImage 의 color. 텍스트만 있는 노드는 배경 없음.
    static string ReadBackground(GameObject go)
    {
        var img = go.GetComponent<Image>();
        if (img != null && img.color.a > 0.01f) return "#" + ColorUtility.ToHtmlStringRGB(img.color);
        var raw = go.GetComponent<RawImage>();
        if (raw != null && raw.color.a > 0.01f) return "#" + ColorUtility.ToHtmlStringRGB(raw.color);
        return null;
    }

    static string SafeId(Transform t)
    {
        // 씬 내 고유 경로(상위/이름) — 디버깅·매칭용
        var sb = new StringBuilder(t.name);
        var p = t.parent;
        int guard = 0;
        while (p != null && guard++ < 16) { sb.Insert(0, p.name + "/"); p = p.parent; }
        return sb.ToString();
    }

    // ---- JSON 직렬화 헬퍼 ----
    static void Str(StringBuilder sb, string key, string val)
    {
        sb.Append('"').Append(key).Append("\":");
        Escape(sb, val);
    }

    static void Escape(StringBuilder sb, string s)
    {
        sb.Append('"');
        foreach (char c in s ?? "")
        {
            switch (c)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                    else sb.Append(c);
                    break;
            }
        }
        sb.Append('"');
    }

#if UNITY_EDITOR
    [MenuItem("Tools/A11y/Export UI JSON")]
    static void ExportMenu()
    {
        string json = Export(Selection.activeGameObject);
        string path = EditorUtility.SaveFilePanel("Export A11y UI JSON", "", "kiosk-ui.json", "json");
        if (!string.IsNullOrEmpty(path))
        {
            System.IO.File.WriteAllText(path, json);
            EditorUtility.RevealInFinder(path);
        }
        EditorGUIUtility.systemCopyBuffer = json; // 클립보드에도 복사
        Debug.Log($"[A11y] UI export 완료: {json.Length} chars (클립보드 복사됨)");
    }
#endif
}
