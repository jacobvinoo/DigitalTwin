import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bot, Play, TrendingUp, TrendingDown, Activity, CheckCircle, Edit3 } from 'lucide-react';

const AgentNode = ({ data, selected }) => {
  return (
    <div className={`bg-white rounded-lg border-2 shadow-sm min-w-[200px] ${selected ? 'border-blue-500 shadow-md' : 'border-gray-200'}`}>
      <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          {data.isEntrypoint ? <Play size={16} className="text-green-600" /> : <Bot size={16} className="text-blue-600" />}
          <span className="font-semibold text-gray-800 text-sm">{data.name}</span>
        </div>
        <span className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded-full">
          {data.modelName || 'default'}
        </span>
      </div>
      
      <div className="p-3 text-xs text-gray-600">
        <p className="truncate mb-2">{data.role || 'No role defined'}</p>
        
        {data.metrics && (
          <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Activity size={10} /> Score
              </span>
              <div className="flex items-center gap-1">
                <span className={`font-semibold ${data.metrics.score >= 8 ? 'text-green-600' : data.metrics.score >= 6 ? 'text-amber-600' : 'text-red-600'}`}>
                  {data.metrics.score.toFixed(1)}
                </span>
                <span className="text-gray-400 text-[10px]">/10</span>
              </div>
            </div>
            
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">Trend</span>
              <div className={`flex items-center gap-1 font-medium ${data.metrics.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.metrics.trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(data.metrics.trend).toFixed(1)}
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle size={10} /> Accept
              </span>
              <span className="font-medium text-gray-700">{data.metrics.acceptanceRate}%</span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Edit3 size={10} /> Revis.
              </span>
              <span className="font-medium text-gray-700">{data.metrics.revisionRate}x</span>
            </div>
          </div>
        )}
      </div>

      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-3 h-3 bg-blue-500 border-2 border-white" 
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-3 h-3 bg-blue-500 border-2 border-white" 
      />
    </div>
  );
};

export default AgentNode;
