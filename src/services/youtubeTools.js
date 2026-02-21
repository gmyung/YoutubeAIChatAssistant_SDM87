// YouTube channel JSON tools: plot_metric_vs_time, play_video, compute_stats_json
// generateImage is handled via API call from Chat (needs image + prompt).

const FIELD_NOTE = 'Use the exact field name from the channel JSON (e.g. view_count, like_count, comment_count, duration_seconds, published_at).';

export const YOUTUBE_TOOL_DECLARATIONS = [
  {
    name: 'generateImage',
    description:
      'Generate an image from a text prompt and an optional anchor/reference image the user provided. Use when the user asks to create, generate, or modify an image based on a description and/or a reference image they attached. Parameters: prompt (required), and optionally anchorImageBase64 and anchorMimeType if the user attached an image.',
    parameters: {
      type: 'OBJECT',
      properties: {
        prompt: { type: 'STRING', description: 'Text description of the image to generate.' },
        anchorImageBase64: { type: 'STRING', description: 'Optional base64 of the reference image (if user attached one).' },
        anchorMimeType: { type: 'STRING', description: 'Optional MIME type of the reference image, e.g. image/png.' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'plot_metric_vs_time',
    description:
      'Plot any numeric field (views, likes, comments, duration, etc.) vs time for the channel videos. Use when the user asks for a chart, graph, or trend over time (e.g. "plot views over time", "graph likes by date").',
    parameters: {
      type: 'OBJECT',
      properties: {
        metric: {
          type: 'STRING',
          description: 'Numeric field to plot on the y-axis. ' + FIELD_NOTE,
        },
        timeField: {
          type: 'STRING',
          description: 'Time/date field for x-axis, usually published_at. Default: published_at',
        },
      },
      required: ['metric'],
    },
  },
  {
    name: 'play_video',
    description:
      'Play or open a YouTube video from the loaded channel data. Use when the user asks to "play", "open", or "watch" a video. The user can specify which video by title (e.g. "play the asbestos video"), ordinal (e.g. "play the first video", "play the 3rd video"), or "most viewed".',
    parameters: {
      type: 'OBJECT',
      properties: {
        selection: {
          type: 'STRING',
          description: 'Either a title fragment (e.g. "asbestos"), an ordinal ("first", "1", "third", "3"), or "most viewed".',
        },
      },
      required: ['selection'],
    },
  },
  {
    name: 'compute_stats_json',
    description:
      'Compute mean, median, std (standard deviation), min, and max for any numeric field in the channel JSON (e.g. view_count, like_count, comment_count, duration_seconds). Use when the user asks for statistics, average, distribution, or summary of a numeric column.',
    parameters: {
      type: 'OBJECT',
      properties: {
        field: {
          type: 'STRING',
          description: 'Exact field name from the channel videos. ' + FIELD_NOTE,
        },
      },
      required: ['field'],
    },
  },
];

function resolveField(videos, name) {
  if (!videos.length || !name) return name;
  const keys = Object.keys(videos[0]);
  if (keys.includes(name)) return name;
  const norm = (s) => s.toLowerCase().replace(/[\s_-]+/g, '');
  const target = norm(name);
  return keys.find((k) => norm(k) === target) || name;
}

function numericValues(videos, field) {
  return videos.map((v) => parseFloat(v[field])).filter((v) => !isNaN(v));
}

function median(sorted) {
  if (!sorted.length) return 0;
  return sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
}

export function executeYouTubeTool(toolName, args, videos, options = {}) {
  if (!Array.isArray(videos)) videos = [];

  switch (toolName) {
    case 'generateImage': {
      return {
        _tool: 'generateImage',
        prompt: args.prompt,
        anchorImageBase64: args.anchorImageBase64 || null,
        anchorMimeType: args.anchorMimeType || null,
        _callApi: true,
      };
    }

    case 'plot_metric_vs_time': {
      const metric = resolveField(videos, args.metric || 'view_count');
      const timeField = resolveField(videos, args.timeField || 'published_at');
      const vals = numericValues(videos, metric);
      const dates = videos.map((v) => v[timeField]).filter(Boolean);
      if (!vals.length || !dates.length) {
        return { error: `No data for metric "${metric}" or time field "${timeField}". Available: ${Object.keys(videos[0] || {}).join(', ')}` };
      }
      const data = videos
        .filter((v) => v[timeField] != null && !isNaN(parseFloat(v[metric])))
        .map((v) => ({
          time: v[timeField],
          date: v[timeField] ? new Date(v[timeField]).toLocaleDateString() : '',
          value: parseFloat(v[metric]),
          title: (v.title || '').slice(0, 40),
        }))
        .sort((a, b) => new Date(a.time) - new Date(b.time));
      return {
        _chartType: 'metric_vs_time',
        metricField: metric,
        timeField,
        data,
      };
    }

    case 'play_video': {
      const sel = (args.selection || '').trim().toLowerCase();
      let chosen = null;
      if (sel === 'most viewed' || sel === 'most viewed video') {
        chosen = [...videos].sort((a, b) => (b.view_count || 0) - (a.view_count || 0))[0];
      } else if (/^first|1(st)?$|^second|2(nd)?$|^third|3(rd)?$|^\d+$/i.test(sel)) {
        const idx = sel === 'first' || sel === '1' || sel === '1st' ? 0
          : sel === 'second' || sel === '2' || sel === '2nd' ? 1
          : sel === 'third' || sel === '3' || sel === '3rd' ? 2
          : parseInt(sel, 10) - 1;
        chosen = videos[idx] || null;
      } else {
        chosen = videos.find((v) => (v.title || '').toLowerCase().includes(sel));
      }
      if (!chosen) {
        return { error: `No video matched "${args.selection}". Try "first", "most viewed", or part of a title.` };
      }
      return {
        _chartType: 'play_video',
        title: chosen.title,
        thumbnail_url: chosen.thumbnail_url,
        video_url: chosen.video_url,
        video_id: chosen.video_id,
      };
    }

    case 'compute_stats_json': {
      const field = resolveField(videos, args.field);
      const vals = numericValues(videos, field);
      if (!vals.length) {
        return { error: `No numeric values for field "${field}". Available: ${Object.keys(videos[0] || {}).join(', ')}` };
      }
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const sorted = [...vals].sort((a, b) => a - b);
      const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
      const std = Math.sqrt(variance);
      return {
        field,
        count: vals.length,
        mean: +mean.toFixed(4),
        median: +median(sorted).toFixed(4),
        std: +std.toFixed(4),
        min: Math.min(...vals),
        max: Math.max(...vals),
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
