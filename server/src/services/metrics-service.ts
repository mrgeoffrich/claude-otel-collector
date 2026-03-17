import prisma from "../lib/prisma";
import { ExportMetricsServiceRequest, NumberDataPoint } from "@claude-otel/lib";
import { parseAttributes, parseTimestamp } from "../lib/otlp-parser";
import { appLogger } from "../lib/logger";

/**
 * Process metrics from an OTLP ExportMetricsServiceRequest.
 * Stores each data point as a MetricSnapshot.
 */
export async function processMetrics(
  request: ExportMetricsServiceRequest,
): Promise<void> {
  const resourceMetrics = request.resourceMetrics || [];

  for (const rm of resourceMetrics) {
    const scopeMetrics = rm.scopeMetrics || [];

    for (const sm of scopeMetrics) {
      const metrics = sm.metrics || [];

      for (const metric of metrics) {
        const metricName = metric.name || "unknown";

        try {
          // Handle sum metrics
          if (metric.sum?.dataPoints) {
            await storeDataPoints(metricName, metric.sum.dataPoints);
          }

          // Handle gauge metrics
          if (metric.gauge?.dataPoints) {
            await storeDataPoints(metricName, metric.gauge.dataPoints);
          }

          // Handle histogram (store count and sum)
          if (metric.histogram?.dataPoints) {
            for (const dp of metric.histogram.dataPoints) {
              const timestamp = parseTimestamp(dp.timeUnixNano);
              const attrs = parseAttributes(dp.attributes);
              if (dp.sum !== undefined) {
                await prisma.metricSnapshot.create({
                  data: {
                    timestamp,
                    metricName: `${metricName}.sum`,
                    value: dp.sum,
                    attributes: JSON.stringify(attrs),
                  },
                });
              }
              if (dp.count !== undefined) {
                await prisma.metricSnapshot.create({
                  data: {
                    timestamp,
                    metricName: `${metricName}.count`,
                    value: parseInt(dp.count, 10),
                    attributes: JSON.stringify(attrs),
                  },
                });
              }
            }
          }
        } catch (err) {
          appLogger.error(
            { err, metricName },
            "Failed to process metric",
          );
        }
      }
    }
  }
}

async function storeDataPoints(
  metricName: string,
  dataPoints: NumberDataPoint[],
) {
  for (const dp of dataPoints) {
    const timestamp = parseTimestamp(dp.timeUnixNano);
    const attrs = parseAttributes(dp.attributes);

    let value = 0;
    if (dp.asDouble !== undefined) {
      value = dp.asDouble;
    } else if (dp.asInt !== undefined) {
      value = parseInt(dp.asInt, 10);
    }

    await prisma.metricSnapshot.create({
      data: {
        timestamp,
        metricName,
        value,
        attributes: JSON.stringify(attrs),
      },
    });
  }
}
