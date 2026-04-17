import React from 'react';
import { Plus, Trash2, FolderOpen } from 'lucide-react';

interface ProjectLibraryProps {
  projects: Record<string, string>;
  onLoad: (name: string) => void;
  onSave: (name: string) => void;
  onDelete: (name: string) => void;
  onClose: () => void;
}

export const ProjectLibrary: React.FC<ProjectLibraryProps> = ({
  projects, onLoad, onSave, onDelete, onClose
}) => {
  return (
    <div className="absolute inset-0 bg-black/95 backdrop-blur-xl z-50 p-12 flex flex-col gap-12 animate-in fade-in zoom-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-4xl font-black italic tracking-tighter uppercase">Project <span className="text-beatscript-purple">Library</span></h2>
        <button onClick={onClose} className="text-gray-500 hover:text-white font-bold tracking-widest">CLOSE [X]</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pb-12">
        <div
          onClick={() => {
            const name = prompt("Enter project name:");
            if (name) onSave(name);
          }}
          className="aspect-video rounded-3xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-4 hover:border-beatscript-purple/50 hover:bg-white/5 transition-all cursor-pointer group"
        >
          <div className="p-4 rounded-full bg-white/5 group-hover:bg-beatscript-purple transition-all">
             <Plus size={32} className="text-white" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-white">New Composition</span>
        </div>

        {Object.entries(projects).map(([name, _]) => (
          <div key={name} className="aspect-video rounded-3xl bg-white/5 border border-white/10 p-8 flex flex-col justify-between group hover:border-beatscript-purple/50 transition-all">
            <div className="flex justify-between items-start">
               <div className="flex items-center gap-3">
                  <FolderOpen size={20} className="text-beatscript-purple" />
                  <h3 className="font-bold text-lg truncate pr-4">{name}</h3>
               </div>
               <button
                 onClick={(e) => { e.stopPropagation(); onDelete(name); }}
                 className="p-2 rounded-lg hover:bg-red-500/10 text-gray-600 hover:text-red-500 transition-all"
               >
                  <Trash2 size={16} />
               </button>
            </div>
            <button
               onClick={() => onLoad(name)}
               className="w-full py-3 rounded-xl bg-beatscript-purple/10 border border-beatscript-purple/20 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-beatscript-purple hover:text-white transition-all shadow-lg shadow-purple-500/0 hover:shadow-purple-500/20"
            >
               Open Script
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
